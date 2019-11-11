# -*- coding: utf-8 -*-

from odoo import models, api


class StockRule(models.Model):
    _inherit = 'stock.rule'

    def _get_custom_move_fields(self):
        fields = super(StockRule, self)._get_custom_move_fields()
        fields += ['ad_is_model_variant', 'order_note', 'order_model_id']
        return fields


class StockMove(models.Model):
    _name = 'stock.move'
    _inherit = ['stock.move', 'odoo.fashion.object.line.mixin']


class StockPicking(models.Model):
    _name = 'stock.picking'
    _inherit = ['stock.picking', 'odoo.fashion.object.mixin']

    @api.model
    def get_odoo4fashion_keys(self, record_id):
        record = self.browse([record_id])
        return {
            'quantity': 'quantity_done',
            'tax_id': '',
            'discount': 'no',
            'common_object_line_name': record.o2m_line_object.relation,
            'model_common_lines_name': record.o2m_line_object.name
        }

    @api.model
    def get_model_lines_report(self):
        res = super(StockPicking, self).get_model_lines_report()
        return res
