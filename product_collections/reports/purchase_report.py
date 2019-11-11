# -*- coding: utf-8 -*-

from odoo import fields, models


class PurchaseReport(models.Model):
    _inherit = "purchase.report"

    collection_id = fields.Many2one(
        comodel_name='product.collection',
        string='Product Collection',
        readonly=True
    )

    def _select(self):
        res = super(PurchaseReport, self)._select()
        res += ",t.collection_id AS collection_id"
        return res

    def _group_by(self):
        res = super(PurchaseReport, self)._group_by()
        res += ", t.collection_id"
        return res
