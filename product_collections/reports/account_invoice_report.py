# -*- coding: utf-8 -*-

from odoo import fields, models


class AccountInvoiceReport(models.Model):
    _inherit = "account.invoice.report"

    collection_id = fields.Many2one(
        comodel_name='product.collection',
        string='Product Collection',
        readonly=True
    )

    def _select(self):
        select_str = super(AccountInvoiceReport, self)._select()
        select_str += """
                  , sub.collection_id
                  """
        return select_str

    def _sub_select(self):
        select_str = super(AccountInvoiceReport, self)._sub_select()
        select_str += """
            , pcoll.id as collection_id
            """
        return select_str

    def _from(self):
        from_str = super(AccountInvoiceReport, self)._from()
        search_str = 'u2.id = pt.uom_id'
        str_index = from_str.index(search_str) + len(search_str)
        from_str = '{} LEFT JOIN product_collection pcoll ON' \
                   ' (pt.collection_id=pcoll.id) {}'.format(
                       from_str[:str_index], from_str[str_index:])

        return from_str

    def _group_by(self):
        group_by_str = super(AccountInvoiceReport, self)._group_by()
        group_by_str += ", pcoll.id"
        return group_by_str
