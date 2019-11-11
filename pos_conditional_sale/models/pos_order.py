# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT
import datetime


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    has_conditional_discount = fields.Boolean()


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def get_conditional_discount_pos(self, order, total):
        conditional_discounts_current = self.env[
            'product.conditional.discount'].sudo().search(
            [('end_date', '>=',
              datetime.datetime.now().strftime(DEFAULT_SERVER_DATE_FORMAT)),
             ('start_date', '<=',
              datetime.datetime.now().strftime(DEFAULT_SERVER_DATE_FORMAT))])
        conditional_discounts = conditional_discounts_current
        # get all products
        product_ids = [line[2].get('product_id') for line in
                       order.get('lines')
                       if not line[2].get('is_return_orderline')]
        product_ids_quants = [{'product_id': line[2].get('product_id'),
                               'quantity': line[2].get('qty')} for line
                              in
                              order.get('lines')
                              if not line[2].get('is_return_orderline')]
        products = self.env['product.product'].browse(product_ids)
        discounts = []
        # check if product have special discounts
        for conditional_discount in conditional_discounts:
            discounts_products = []
            product_count = 0
            for product in products:
                product_discount = self.env[
                    'product.template.conditional.discount'].sudo().search(
                    [('product_tmpl_id', '=', product.product_tmpl_id.id),
                     ('conditional_discount_id', '=', conditional_discount.id)]
                )
                if product_discount:
                    product_ids = [rec.get('product_id')
                                   for rec in discounts_products]
                    if product.id not in product_ids:
                        discount = product_discount.discount
                        discounts_products.append(
                            {'product_id': product.id, 'discount': discount})
            # assign discount based on the total order quantity
            for discount_prod in discounts_products:
                for product in product_ids_quants:
                    if product.get('product_id') == discount_prod.get(
                            'product_id'):
                        discounts.append(
                            {'product_id': discount_prod.get('product_id'),
                             'discount': discount_prod.get('discount')
                             })
                        product_count += product.get('quantity')
            # special step discounts
            steps = self.env['product.conditional.step'].sudo().search(
                [('step_count', '<=', product_count),
                 ('conditional_discount_id', '=', conditional_discount.id)],
                order='step_count desc', limit=1)
            for discount in discounts:
                if discount.get('discount') == 0:
                    if steps:
                        discount['discount'] = steps.step_discount
        return discounts
