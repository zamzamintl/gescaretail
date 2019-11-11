# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
import odoo.addons.decimal_precision as dp


class PurchaseOrderLine(models.Model):
    _name = 'purchase.order.line'
    _inherit = ['purchase.order.line', 'odoo.fashion.object.line.mixin']

    @api.multi
    def _prepare_stock_moves(self, picking):
        res = super(PurchaseOrderLine, self)._prepare_stock_moves(picking)
        for template in res:
            template['order_model_id'] = self.order_model_id
            template['order_note'] = self.order_note
            template['ad_is_model_variant'] = self.ad_is_model_variant
        return res

    def _suggest_quantity(self):
        '''
        Suggest a minimal quantity based on the seller
        '''
        if not self.product_id:
            return

        seller_min_qty = self.product_id.seller_ids \
            .filtered(lambda r: r.name == self.order_id.partner_id) \
            .sorted(key=lambda r: r.min_qty)
        if seller_min_qty:
            self.product_qty = seller_min_qty[0].min_qty or 0
            self.product_uom = seller_min_qty[0].product_uom
        else:
            self.product_qty = 0


class PurchaseOrder(models.Model):
    _name = 'purchase.order'
    _inherit = ['purchase.order', 'odoo.fashion.object.mixin']

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

    date_planned = fields.Datetime(
        string='Scheduled Date',
        index=False,
        store=True,
        compute=False
    )

    @api.model
    def order_compute(self, purchase_id):
        purchase_order = self.env['purchase.order'].browse([purchase_id])
        return purchase_order._amount_all()

    @api.depends('order_line.date_planned')
    def _compute_date_planned(self):
        for order in self:
            order.date_planned = order.date_planned

    @api.onchange('date_planned')
    def _set_date_planned(self):
        for order in self:
            for line in order.order_line:
                line.update({
                    'date_planned': order.date_planned
                })

    @api.multi
    def action_set_date_planned(self):
        for order in self:
            order.order_line.update({'date_planned': order.date_planned})

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _get_total_order_qty(self):
        for order in self:
            order.order_count = sum(
                map(lambda x: x.product_qty, order.order_line)
            )

    @api.depends('amount_untaxed', 'amount_tax', 'amount_total')
    def _duplicate_amount(self):
        self.ad_ro_amount_untaxed = self.amount_untaxed
        self.ad_ro_amount_tax = self.amount_tax
        self.ad_ro_amount_total = self.amount_total

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        record = self.browse([record_id])
        return {
            'quantity': 'product_qty',
            'tax_id': 'taxes_id',
            'discount': 'no',
            'common_object_line_name': record.o2m_line_object.relation,
            'model_common_lines_name': record.o2m_line_object.name,
            'model_edit_states': ['draft', 'sent']
        }

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        res = super(PurchaseOrder, self).get_odoo4fashion_keys(record_id)
        res.update({
            'quantity': 'product_qty',
            'tax_id': 'taxes_id',
            'discount': 'no',
            'model_warehouse_name': 'no',
            'model_partner_id': 'partner_id',
            'model_pricelist_id': 'no',
            'model_date_order': 'date_order',
            'model_fiscal_position_id': 'fiscal_position_id',
            'model_state': 'state',
        })
        return res

    @api.model
    def get_model_lines_report(self):
        res = super(PurchaseOrder, self).get_model_lines_report()
        variantlines = []

        for line in res.get('lines'):
            arr_variants = line.get("variants")
            for variant in arr_variants:
                if len(variantlines) > 0:
                    hasid = False
                    for l in variantlines:
                        if l['price_unit'] == variant.price_unit:
                            l['product_qty'] = l['product_qty'] \
                                + variant.product_qty
                            l['price_subtotal'] = float(
                                int(l['product_qty']) * variant.price_unit)
                            hasid = True
                    if not hasid:
                        variantlines.append({
                            'product_name': variant.product_id.product_tmpl_id.
                            display_name,
                            'product_qty': variant.product_qty,
                            'price_unit': variant.price_unit,
                            'taxes_id': variant.taxes_id,
                            'price_subtotal': variant.price_subtotal
                        })
                else:
                    variantlines.append({
                        'product_name': variant.product_id.product_tmpl_id.
                        display_name,
                        'product_qty': variant.product_qty,
                        'price_unit': variant.price_unit,
                        'taxes_id': variant.taxes_id,
                        'price_subtotal': variant.price_subtotal
                    })
            line["variant_lines"].append(variantlines)
            variantlines = []

        return res

    @api.model
    def create_new_line(self, partner_id, pricelist_id, product_id, qty,
                        date_order, fiscal_position_id, state, **args):
        fiscal_position = fiscal_position_id
        product = self.env['product.product'].browse(product_id)
        if type(qty) != int and qty <= 0:
            qty = 0

        vals = {}
        vals['product_id'] = product_id
        vals['product_uom'] = product.uom_id.id
        vals['product_qty'] = qty
        vals['ad_is_model_variant'] = True
        vals['date_planned'] = datetime.today().strftime(
            DEFAULT_SERVER_DATETIME_FORMAT)
        vals['qty_invoiced'] = 0
        vals['state'] = state

        product = product.with_context(
            lang=partner_id.lang,
            partner=partner_id.id,
            quantity=qty,
            date=datetime.today().strftime(
                DEFAULT_SERVER_DATETIME_FORMAT),
            pricelist=pricelist_id,
            uom=product.uom_id.id
        )
        seller = product._select_seller(
            partner_id=partner_id,
            quantity=qty,
            date=datetime.today().strftime(DEFAULT_SERVER_DATETIME_FORMAT),
            uom_id=product[0].uom_id
        )

        name = product.name_get()[0][1]
        vals['name'] = name

        fpos = fiscal_position or partner_id.property_account_position_id
        if fpos:
            tax_id = fpos.map_tax(product.supplier_taxes_id)
        else:
            tax_id = product.supplier_taxes_id if product.supplier_taxes_id \
                else False

        if not seller.id and len(product.product_tmpl_id.seller_ids) > 0:
            seller = product.product_tmpl_id.seller_ids.filtered(
                lambda r: r.product_id.id is False)

        tax_obj = self.env['account.tax']
        if seller:
            vals['price_unit'] = tax_obj._fix_tax_included_price(
                seller[0].price,
                product.supplier_taxes_id,
                tax_id
            )
            qty = seller[0].min_qty
            vals['product_qty'] = qty
        else:
            vals['price_unit'] = tax_obj._fix_tax_included_price(
                product.price,
                product.supplier_taxes_id,
                tax_id
            )

        vals['price_subtotal'] = qty * vals['price_unit']

        if tax_id is not False:
            vals['taxes_id'] = tax_id.ids

        return {'value': vals}
