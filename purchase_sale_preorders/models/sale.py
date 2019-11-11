# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class SaleOrder(models.Model):
    _inherit = "sale.order"

    state = fields.Selection(
        selection_add=[('preorder', "Pre-order")]
    )
    ad_po_date = fields.Datetime(
        string="Estimated delivery date",
        default=lambda self: fields.Datetime.now()
    )
    collection_id = fields.Many2one(
        comodel_name="product.collection",
        string="Collection"
    )
    preorder_complete = fields.Boolean(
        string="Pre-order Processed",
    )
    is_preorder = fields.Boolean(
        string="Is a Pre-Order"
    )

    @api.onchange('ad_po_date')
    def _set_date(self):
        if self.ad_po_date:
            self.requested_date = self.ad_po_date

    @api.multi
    def set_pre_order(self):
        if self.collection_id and self.ad_po_date:
            self.commitment_date = self.ad_po_date
            self.is_preorder = True
            self.action_confirm()
        else:
            raise ValidationError(
                "Fields Collection and Estimated delivery "
                "date on the tab Pre-Order needs to be filled in "
            )
