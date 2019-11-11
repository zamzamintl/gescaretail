# -*- coding: utf-8 -*-

from odoo import fields, models


class PurchaseReport(models.Model):
    _inherit = "purchase.report"

    gender = fields.Selection(
        selection=[
            ('men', 'Men'),
            ('women', 'Women'),
            ('unisex', 'Unisex'),
            ('boys', 'Boys'),
            ('girls', 'Girls'),
            ('baby', 'Babies'),
            ('other', 'Other'),
        ],
        string='Gender',
    )

    def _select(self):
        res = super(PurchaseReport, self)._select()
        res += ",t.gender AS gender"
        return res

    def _group_by(self):
        res = super(PurchaseReport, self)._group_by()
        res += ", t.gender"
        return res
