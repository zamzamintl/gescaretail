# -*- coding: utf-8 -*-

from odoo import models


class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = 'sale.order'

    def action_sale_history(self):
        return {
            "name": 'Order History',
            "context": {'search_default_partner_id': self.partner_id.id,
                        'show_sale': True},
            "views": [
                (self.env.ref('sale.view_quotation_tree_with_onboarding')
                 .id,
                 'tree'),
                (self.env.ref('sale.sale_order_view_search_inherit_quotation')
                 .id, 'form')],
            "res_model": 'sale.order',
            "type": 'ir.actions.act_window',
            "view_mode": 'tree,form'
        }
