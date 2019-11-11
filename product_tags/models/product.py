# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ProductTag(models.Model):
    _description = 'Product Tags'
    _name = "product.tag"
    _rec_name = 'name'

    name = fields.Char(
        string='Tag Name',
        required=True,
        translate=True
    )

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        args = args or []
        if name:
            # Be sure name_search is symetric to name_get
            name = name.split(' / ')[-1]
            args = [('name', operator, name)] + args
        tags = self.search(args, limit=limit)
        return tags.name_get()


class ProductTemplate(models.Model):
    _inherit = "product.template"

    tag_ids = fields.Many2many(
        string='Tags',
        comodel_name='product.tag',
        relation='product_product_tag_rel',
        column1='tag_id',
        column2='product_id'
    )
