# -*- coding: utf-8 -*-

from odoo import fields, models


class AccountInvoiceReport(models.Model):
    _inherit = "account.invoice.report"

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
        select_str = super(AccountInvoiceReport, self)._select()
        select_str += """
            , sub.gender as gender
            """
        return select_str

    def _sub_select(self):
        select_str = super(AccountInvoiceReport, self)._sub_select()
        select_str += """
            , pt.gender
            """
        return select_str

    def _group_by(self):
        group_by_str = super(AccountInvoiceReport, self)._group_by()
        group_by_str += ", pt.gender"
        return group_by_str
