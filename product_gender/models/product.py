# -*- coding: utf-8 -*-

from odoo import models, fields


class ProductTemplate(models.Model):
    _inherit = 'product.template'

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
        required=True,
    )
