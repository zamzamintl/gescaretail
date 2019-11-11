# -*- coding: utf-8 -*-

from odoo import models, api


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    @api.multi
    def _prepare_procurement_values(self, group_id=False):
        values = super(SaleOrderLine, self)._prepare_procurement_values(
            group_id)
        values.update({
            'ad_is_model_variant': self.ad_is_model_variant,
            'order_note': self.order_note,
            'order_model_id': self.order_model_id
        })
        return values
