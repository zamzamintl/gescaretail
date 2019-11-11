# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleReport(models.Model):
    _inherit = "sale.report"

    product_brand_id = fields.Many2one(
        'product.brand',
        string='Brand',
    )
    vendor_id = fields.Many2one(
        string='Vendor',
        comodel_name='res.partner',
    )

    def _query(self, with_clause='', fields={}, groupby='', from_clause=''):
        fields['product_brand_id'] = ", t.product_brand_id"
        fields['vendor_id'] = ",t.vendor_id"
        groupby += ", t.product_brand_id"
        groupby += ", t.vendor_id"

        return super(SaleReport, self)._query(with_clause, fields, groupby,
                                              from_clause)
