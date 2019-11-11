# -*- coding: utf-8 -*-
from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    composition_tag_ids = fields.Many2many(
        comodel_name='product.composition.tag',
        string='Compositions'
    )
