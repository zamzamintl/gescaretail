# -*- coding: utf-8 -*-

from odoo import fields, models


class AccountInvoiceReport(models.Model):
    _inherit = "account.invoice.report"

    product_brand_id = fields.Many2one(
        'product.brand',
        string='Brand',
    )
    vendor_id = fields.Many2one(
        string='Vendor',
        comodel_name='res.partner',
    )

    def _select(self):
        select_str = super(AccountInvoiceReport, self)._select()
        select_str += """
            , sub.product_brand_id as product_brand_id
            , sub.vendor_id as vendor_id
            """
        return select_str

    def _sub_select(self):
        select_str = super(AccountInvoiceReport, self)._sub_select()
        select_str += """
            , pt.product_brand_id
            , pt.vendor_id
            """
        return select_str

    def _group_by(self):
        group_by_str = super(AccountInvoiceReport, self)._group_by()
        group_by_str += ", pt.product_brand_id, pt.vendor_id"
        return group_by_str
