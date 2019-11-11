# -*- coding: utf-8 -*-

from odoo import models, fields


class StockMove(models.Model):
    _inherit = 'stock.move'

    color_attribute_id = fields.Many2one(
        string="Color Attribute",
        comodel_name='product.attribute.value',
        related='product_id.color_attribute_id',
        store=True
    )
    size_attribute_id = fields.Many2one(
        string="Size Attribute",
        comodel_name='product.attribute.value',
        related='product_id.size_attribute_id',
        store=True
    )
