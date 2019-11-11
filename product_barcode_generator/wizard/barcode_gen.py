# -*- coding: utf-8 -*-
from odoo import models, api


class ProductProductBarcodegen(models.TransientModel):
    _name = "product.product.barcodegen"
    _description = "Export invoices to factoring import files"

    @api.multi
    def gen_barcodes(self):
        active_ids = self._context.get('active_ids', []) or []
        self.env['product.product'].generate_ean13_bulk(active_ids)
