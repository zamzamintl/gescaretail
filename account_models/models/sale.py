# -*- coding: utf-8 -*-
from odoo import models, api


class SaleOrderLine(models.Model):
    _name = 'sale.order.line'
    _inherit = 'sale.order.line'

    @api.multi
    def _prepare_invoice_line(self, qty):
        res = super(SaleOrderLine, self)._prepare_invoice_line(qty)
        res['ad_is_model_variant'] = self.ad_is_model_variant
        res['order_model_id'] = self.order_model_id
        res['order_note'] = self.order_note
        return res
