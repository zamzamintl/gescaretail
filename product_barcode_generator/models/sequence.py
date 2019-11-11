# -*- coding: utf-8 -*-


from odoo import fields, models


class IrSequence(models.Model):
    _inherit = 'ir.sequence'

    barcode_sequence = fields.Boolean('Barcode Sequence', default=False)
