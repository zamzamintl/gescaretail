# -*- coding: utf-8 -*-

from odoo import fields, models


class PurchaseReport(models.Model):
    _inherit = "purchase.report"

    product_brand_id = fields.Many2one(
        'product.brand',
        string='Brand',
    )

    def _select(self):
        res = super(PurchaseReport, self)._select()
        res += ",t.product_brand_id AS product_brand_id"
        return res

    def _group_by(self):
        res = super(PurchaseReport, self)._group_by()
        res += ", t.product_brand_id"
        return res
