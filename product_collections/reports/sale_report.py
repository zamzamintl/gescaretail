# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleReport(models.Model):
    _inherit = "sale.report"

    collection_id = fields.Many2one(
        comodel_name='product.collection',
        string='Product Collection',
        readonly=True
    )

    def _query(self, with_clause='', fields={}, groupby='', from_clause=''):
        fields['collection_id'] = ",  pcoll.id as collection_id"
        from_clause += "left join product_collection pcoll on " \
                       "(t.collection_id=pcoll.id)"
        groupby += ", pcoll.id"

        res = super(SaleReport, self)._query(with_clause, fields, groupby,
                                             from_clause)
        return res
