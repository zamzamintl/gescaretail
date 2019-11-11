# -*- coding: utf-8 -*-
from odoo import models, fields


class ProductCompositionTag(models.Model):
    _name = 'product.composition.tag'

    name = fields.Char(required=True, translate=True)
