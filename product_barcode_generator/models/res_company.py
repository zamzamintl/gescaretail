# -*- coding: utf-8 -*-

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    ean_sequence_id = fields.Many2one('ir.sequence', 'Ean Sequence')
