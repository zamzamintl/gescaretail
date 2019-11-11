# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleReport(models.Model):
    _inherit = "sale.report"

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
        required=True,
    )

    def _query(self, with_clause='', fields={}, groupby='', from_clause=''):
        fields['gender'] = ", t.gender"

        groupby += ", t.gender"

        return super(SaleReport, self)._query(with_clause, fields, groupby,
                                              from_clause)
