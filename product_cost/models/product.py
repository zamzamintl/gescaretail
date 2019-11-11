# -*- coding: utf-8 -*-


from odoo import models, fields, api, _
from odoo.exceptions import UserError
import odoo.addons.decimal_precision as dp


class ProductTemplateCost(models.Model):
    _name = 'product.template.cost'
    _order = 'product_template_id desc, sequence, id'

    name = fields.Char(
        required=True
    )
    sequence = fields.Integer(
        string="Sequence"
    )
    is_percent = fields.Boolean(
        string='Is Percent'
    )
    based_on = fields.Selection(
        [('previous', 'previous'),
         ('cost', 'purchase cost'),
         ('list', 'list price'),
         ('supplier', 'supplier price')],
        string='Based On',
        default='previous'
    )
    value = fields.Float(
        string="Amount",
        required=True
    )
    product_template_id = fields.Many2one(
        comodel_name='product.template'
    )


class ProductTemplate(models.Model):
    _name = 'product.template'
    _inherit = 'product.template'

    ad_purchase_cost = fields.Float(
        string='Purchase cost',
        digits=dp.get_precision('Product Price')
    )
    ad_margin = fields.Float(
        string='Margin',
        compute='_compute_margin',
        digits=dp.get_precision('Product Price')
    )

    ad_standard_price = fields.Float(
        string='Cost price',
        compute='_calculate_cost',
        digits=dp.get_precision('Product Price')
    )

    ad_product_cost_ids = fields.One2many(
        comodel_name='product.template.cost',
        inverse_name='product_template_id'
    )

    @api.depends('ad_purchase_cost', 'list_price', 'ad_product_cost_ids',
                 'ad_product_cost_ids.value',
                 'ad_product_cost_ids.based_on',
                 'ad_product_cost_ids.is_percent', 'seller_ids',
                 'seller_ids.price')
    def _calculate_cost(self):
        for record in self:
            price = record.ad_purchase_cost

            is_first_item = True
            for item in record.ad_product_cost_ids:
                if item.based_on == 'cost':
                    calculated_on = record.ad_purchase_cost
                elif item.based_on == 'list':
                    calculated_on = record.list_price
                elif item.based_on == 'supplier':
                    if not record.seller_ids:
                        raise UserError(
                            _("When 'based on' method is 'supplier', "
                              "a supplier must be configured on this tab"))
                    if not record.seller_ids[0].price:
                        raise UserError(_(
                            "When 'based on' method is 'supplier', a "
                            "price must be given on the first supplier "
                            "with a minimum quantity of 0"))
                    price_found = False
                    ci = 0
                    for pricelistinfo in record.seller_ids:

                        if pricelistinfo.min_qty == 0.0:
                            purchase_currency = record.seller_ids[ci].name.\
                                property_product_pricelist_purchase.currency_id
                            company_currency = record.env.user.\
                                company_id.currency_id

                            calculated_on = purchase_currency.compute(
                                pricelistinfo.price, company_currency,
                                round=False)
                            price_found = True
                            if is_first_item:
                                price = calculated_on
                            ci += 1

                    if not price_found:
                        raise UserError(_(
                            "When 'based on' method is 'supplier', a price"
                            "must be given on the first supplier with a "
                            "minimum quantity of 0"))
                else:
                    calculated_on = price

                if item.is_percent:
                    calculated = calculated_on * (item.value/100)
                    result = price + calculated
                else:
                    result = price + item.value

                price = result
                is_first_item = False

            record.ad_standard_price = price

    @api.onchange('ad_standard_price')
    def _save_cost(self):
        self.standard_price = self.ad_standard_price

    @api.depends('list_price', 'standard_price')
    def _compute_margin(self):
        for record in self:
            if record.ad_standard_price == 0:
                record.ad_standard_price = 1
                record.ad_margin = record.list_price / record.ad_standard_price
            else:
                record.ad_margin = record.list_price / record.ad_standard_price

    @api.multi
    def copy(self, default=None):
        res = super(ProductTemplate, self).copy(default=default)

        for seller in self.seller_ids:
            res.seller_ids.create({
                'name': seller.name.id,
                'product_name': seller.product_name,
                'product_code': seller.product_code,
                'sequence': seller.sequence,
                'product_uom': seller.product_uom,
                'min_qty': seller.min_qty,
                'product_tmpl_id': res.id,
                'delay': seller.delay,
                'company_id': seller.company_id.id,
            })

        for cost in self.ad_product_cost_ids:
            res.ad_product_cost_ids.create({
                'sequence': cost.sequence,
                'is_percent': cost.is_percent,
                'based_on': cost.based_on,
                'name': cost.name,
                'value': cost.value,
                'product_template_id': res.id,
            })

        res._calculate_cost()
        res._save_cost()
        res._compute_margin()

        return res
