# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval as eval


class ProductPrices(models.TransientModel):
    _name = 'product.prices'

    product_prices_id = fields.Many2one(
        comodel_name='wizard.product.prices'
    )
    attribute_ids = fields.Many2many(
        comodel_name='product.attribute.value',
    )
    attribute_view_ids = fields.Many2many(
        comodel_name='product.attribute.value',
    )
    margin = fields.Float(
        string='Margin',
    )
    sales_price = fields.Float()
    purchase_price = fields.Float()

    @api.onchange('purchase_price', 'sales_price')
    def _get_price_margin(self):
        for record in self:
            if record.sales_price != 0 and record.purchase_price != 0:
                record.margin = record.sales_price / record.purchase_price
            else:
                record.margin = 0


class WizardProductPrices(models.TransientModel):
    _name = 'wizard.product.prices'
    _description = 'Sets sales & purchase prices foreach variant'

    @api.onchange('pricelist_id', 'filter_search')
    def _change_product_prices(self):
        product_price_ids = self.env['product.prices']

        product_tmpl = self.env['product.template'].browse(
            [self.env.context.get('active_id')])

        purchase_price = product_tmpl.standard_price
        if not product_tmpl.vendor_id:
            raise UserError(_('No vendor set on product'))
        attributes_ids_sublist = [pp.attribute_value_ids.ids for pp in
                                  product_tmpl.product_variant_ids]
        attributes_ids = list(set(
            [item for sublist in attributes_ids_sublist for item in sublist]
        ))
        if self.filter_search:
            attributes_ids = self.env['product.attribute.value'].search(
                [('name', 'ilike', self.filter_search),
                 ('id', 'in', attributes_ids)]).ids
        product_sorted = []
        products = self.env['product.product']
        if product_tmpl.model_size_attribute:
            for attribute_value in product_tmpl.attribute_line_ids.filtered(
                    lambda r: r.attribute_id.attribute_type == 'size'). \
                    value_ids:
                products = self.env['product.product'].search(
                    [('product_tmpl_id', '=', product_tmpl.id),
                     ('attribute_value_ids', '=', attribute_value.id)]
                )
                for product in products:
                    product_sorted.append(product)
        else:
            for attribute_value in product_tmpl.attribute_line_ids.filtered(
                    lambda r: r.attribute_id.attribute_type == 'color') \
                    .value_ids:
                products = self.env['product.product'].search(
                    [('product_tmpl_id', '=', product_tmpl.id),
                     ('attribute_value_ids', '=', attribute_value.id)]
                )
                for product in products:
                    product_sorted.append(product)

        for product in product_sorted:
            supplierinfo_ids = self.env[
                'product.supplierinfo'].search(
                [
                    '&',
                    ('product_id', '=', product.id),
                    ('name', '=', product.vendor_id.id)
                ])
            if len(supplierinfo_ids) > 1:
                raise UserError(
                    _('Multiple prices found for the same vendor'))
            elif len(supplierinfo_ids) == 1:
                purchase_price = supplierinfo_ids.price
            # sale price per variant
            if self.pricelist_id:
                sales_price = product.with_context(
                    pricelist=self.pricelist_id.id).price
            else:
                if product.price_extra + product.lst_price > 0:
                    sales_price = product.price_extra + product. \
                        lst_price
                else:
                    sales_price = product_tmpl.list_price

            if not purchase_price:
                margin = 0
            else:
                margin = sales_price / purchase_price
            if set(product.attribute_value_ids.ids) & set(attributes_ids):
                product_price_ids += self.env['product.prices'].new({
                    'attribute_ids': [(6, 0, product.attribute_value_ids.sorted
                                       (
                                           key=lambda r: r.attribute_id.
                                           attribute_type, reverse=True)
                                       .ids
                                       )],
                    'attribute_view_ids': [
                        (6, 0, product.attribute_value_ids.sorted(
                            key=lambda r: r.attribute_id.attribute_type,
                            reverse=True
                        ).ids)],
                    'sales_price': sales_price,
                    'purchase_price': purchase_price,
                    'margin': margin,
                })
        self.product_prices_ids = product_price_ids

    filter_search = fields.Char(
        string='Filter variant list'
    )
    pricelist_id = fields.Many2one(
        string='Select a pricelist',
        comodel_name='product.pricelist'
    )
    product_prices_ids = fields.One2many(
        comodel_name='product.prices',
        inverse_name='product_prices_id',
        string='Product Prices',
    )

    def save_changes(self):
        self.ensure_one()
        product_tmpl = self.env['product.template'].browse(
            [self.env.context.get('active_id')]
        )
        for product_attribute_price in self.product_prices_ids:
            domain = [('product_tmpl_id', '=', product_tmpl.id)]
            domain += [
                eval("('attribute_value_ids','='," + str(value.id) + ')')
                for
                value in
                product_attribute_price.attribute_ids]
            product_ids = self.env['product.product'].search(domain)

            sales_price = product_attribute_price.sales_price
            purchase_price = product_attribute_price.purchase_price

            for prod in product_ids:

                supplierinfo_ids = self.env['product.supplierinfo'].search([
                    '&',
                    ('product_id', '=', prod.id),
                    ('name', '=', prod.vendor_id.id)
                ])
                if self.pricelist_id:
                    if prod.with_context(pricelist=self.pricelist_id.id) \
                            .price != sales_price:
                        pricelist_item_id = self.env[
                            'product.pricelist.item'].search(
                            [('pricelist_id', '=', self.pricelist_id.id),
                             ('product_id', '=', prod.id)])
                        if pricelist_item_id:
                            pricelist_item_id.write({
                                'fixed_price': sales_price
                            })
                        else:
                            self.env['product.pricelist.item'].create({
                                'product_id': prod.id,
                                'product_tmpl_id': prod.product_tmpl_id.id,
                                'fixed_price': sales_price,
                                'pricelist_id': self.pricelist_id.id
                            })
                else:
                    prod.write({'lst_price': sales_price})

                if supplierinfo_ids:
                    supplierinfo_ids.write({
                        'price': purchase_price,
                        'min_qty': 1,
                        'product_id': prod.id,
                        'product_tmpl_id': product_tmpl.id
                    })
                else:
                    supplierinfo_ids.create({
                        'min_qty': 1,
                        'price': purchase_price,
                        'name': prod.vendor_id.id,
                        'product_id': prod.id,
                        'product_tmpl_id': product_tmpl.id
                    })
                prod.standard_price = purchase_price

        return True
