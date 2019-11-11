# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    pos_changeprice_allowed = fields.Boolean(string='Allowed Change Pos Price',
                                             default=True)
    pos_discount_allowed = fields.Boolean(string='Allowed Pos Discount',
                                          default=True)


class ResPartner(models.Model):
    _inherit = "res.partner"

    pos_fixed_discount = fields.Float(string="Fixed Discount")


class PosOrder(models.Model):
    _inherit = "pos.order"

    order_discount = fields.Float('Order Discount %')

    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res.update({
            'order_discount': ui_order.get('order_discount') or 0.0,
        })
        return res


class ProductTemplate(models.Model):
    _inherit = "product.template"

    pos_no_discount_allowed = fields.Boolean(string='Pos No Discount Allowed')
