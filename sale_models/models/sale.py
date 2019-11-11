# -*- coding: utf-8 -*-
import odoo.addons.decimal_precision as dp
from odoo import models, fields, api

SUPERUSER_ID = 1


class SaleOrderLine(models.Model):
    _name = 'sale.order.line'
    _inherit = ['sale.order.line', 'odoo.fashion.object.line.mixin']

    @api.onchange('product_uom_qty', 'product_uom', 'route_id')
    def _onchange_product_id_check_availability(self):
        return {}


class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = ['sale.order', 'odoo.fashion.object.mixin']

    ad_ro_amount_untaxed = fields.Float(
        string='Amount untaxed',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )
    ad_ro_amount_tax = fields.Float(
        string='Amount tax',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )
    ad_ro_amount_total = fields.Float(
        string='Amount total',
        compute='_duplicate_amount',
        digits=dp.get_precision('Account')
    )

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        res = super(SaleOrder, self).get_odoo4fashion_keys(record_id)

        res.update({
            'quantity': 'product_uom_qty',
            'tax_id': 'tax_id',
            'discount': 'discount',
            'model_warehouse_name': 'warehouse_id',
            'model_partner_id': 'partner_id',
            'model_pricelist_id': 'pricelist_id',
            'model_date_order': 'date_order',
            'model_fiscal_position_id': 'fiscal_position_id',
            'model_state': 'state',
            'model_edit_states': ['draft', 'sent', 'sale']
        })
        return res

    @api.model
    def order_compute(self, order_id):
        return self.env['sale.order'].browse([order_id])._amount_all()

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _get_total_order_qty(self):
        for order in self:
            order.order_count = sum(
                map(lambda x: x.product_uom_qty, order.order_line))

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _duplicate_amount(self):
        self[0].ensure_one()
        self[0].ad_ro_amount_untaxed = self[0].amount_untaxed
        self[0].ad_ro_amount_tax = self[0].amount_tax
        self[0].ad_ro_amount_total = self[0].amount_total

    def get_product_discount_partner(self, product_id, partner_id,
                                     pricelist_id):
        discount = 0
        if len(pricelist_id.item_ids) > 0:
            for item in filter(lambda x: x.applied_on == u'3_global',
                               pricelist_id.item_ids):
                return item.percent_price

        return discount

    @api.model
    def get_model_lines_report(self):
        res = super(SaleOrder, self).get_model_lines_report()
        variantlines = []
        for line in res.get('lines'):
            arr_variants = line.get("variants")
            for variant in arr_variants:
                if len(variantlines) > 0:
                    hasid = False
                    for l in variantlines:
                        if l['price_unit'] == variant.price_unit:
                            l['product_uom_qty'] = l['product_uom_qty'] + \
                                variant.product_uom_qty
                            l['price_subtotal'] += variant.price_subtotal
                            hasid = True
                    if not hasid:
                        variantlines.append({
                            'product_name':
                                variant.product_id.product_tmpl_id.
                                display_name,
                            'product_uom_qty': variant.product_uom_qty,
                            'price_unit': variant.price_unit,
                            'discount': variant.discount,
                            'tax_id': variant.tax_id,
                            'price_subtotal': variant.price_subtotal
                        })
                else:
                    variantlines.append({
                        'product_name':
                            variant.product_id.product_tmpl_id.display_name,
                        'product_uom_qty': variant.product_uom_qty,
                        'price_unit': variant.price_unit,
                        'tax_id': variant.tax_id,
                        'discount': variant.discount,
                        'price_subtotal': variant.price_subtotal
                    })
            line["variant_lines"].append(variantlines)
            variantlines = []
        return res

    @api.model
    def create_new_line(self, partner_id, pricelist_id, product_id, qty,
                        date_order, fiscal_position_id, state, **args):
        product_id = self.env['product.product'].browse([product_id])
        discount = self.get_product_discount_partner(product_id, partner_id,
                                                     pricelist_id)
        vals = {
            'product_id': product_id.id,
            'product_uom': product_id.uom_id.id,
            'product_uom_qty': qty,
            'invoice_status': 'no',
            'qty_invoiced': 0,
            'ad_is_model_variant': True,
            'state': state,
            'order_model_id': 0,
            'order_note': '',
            'discount': 0 if not discount else discount,
            'product_updatable': True
        }
        product = product_id.with_context(
            lang=partner_id.lang,
            partner=partner_id.id,
            quantity=qty,
            date=date_order,
            pricelist=pricelist_id.id,
            uom=product_id.uom_id.id
        )

        name = product.name_get()[0][1]
        vals['name'] = name

        fpos = fiscal_position_id or partner_id.property_account_position_id
        if fpos:
            tax_id = fpos.map_tax(product.taxes_id)
        else:
            tax_id = product.taxes_id if product.taxes_id else False
        price = pricelist_id.get_product_price_rule(
            product, 1.0, partner_id)
        vals['price_unit'] = self.env['account.tax']._fix_tax_included_price(
            price[0], product.taxes_id,
            tax_id)

        if tax_id is not False:
            vals['tax_id'] = tax_id.ids

        return {'value': vals}
