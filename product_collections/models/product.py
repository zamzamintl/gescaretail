# -*- coding: utf-8 -*-
from odoo import models, fields, api


class ProductCollection(models.Model):
    _description = "Product Collection"
    _name = "product.collection"
    _rec_name = "name"

    name = fields.Char('Collection Name', required=True, translate=True)

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        args = args or []
        if name:
            # Be sure name_search is symetric to name_get
            name = name.split(' / ')[-1]
            args = [('name', operator, name)] + args
        collection = self.search(args, limit=limit)
        return collection.name_get()


class ProductTemplate(models.Model):
    _inherit = "product.template"

    collection_id = fields.Many2one(
        comodel_name="product.collection",
        string="Collection"
    )
