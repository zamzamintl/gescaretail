# -*- coding: utf-8 -*-
from odoo import fields, models


class ProductAttribute(models.Model):
    _inherit = 'product.attribute'

    attribute_type = fields.Selection(
        selection=[
            ('color', 'Color'),
            ('size', 'Size')
        ],
        string='Attribute type',
        required=1,
    )


class ProductAttributevalue(models.Model):
    _inherit = "product.attribute.value"
    _order = 'attribute_sequence, sequence'

    attribute_sequence = fields.Integer(
        'Attribute Sequence',
        related='attribute_id.sequence',
        help="Determine the display order",
        store=True,
    )
    attribute_type = fields.Selection(
        selection=[
            ('color', 'Color'),
            ('size', 'Size')
        ],
        # related='attribute_id.attribute_type',
        string='Attribute type', related='attribute_id.attribute_type'
    )
