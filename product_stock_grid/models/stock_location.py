# -*- coding: utf-8 -*-

from odoo import models, fields


class StockLocation(models.Model):
    _inherit = 'stock.location'

    sequence = fields.Integer(
        string='Sequence',
        default=1,
    )
