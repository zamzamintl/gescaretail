from odoo import fields, models, api


class PosOrder(models.Model):
    _inherit = 'pos.order'

    sale_user_id = fields.Many2one(
        comodel_name='res.users', string='Sale User',
        default=lambda self: self.env.uid,
        states={'done': [('readonly', True)],
                'invoiced': [('readonly', True)]},
    )

    @api.model
    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res['sale_user_id'] = ui_order['sale_user_id'] or False
        return res
