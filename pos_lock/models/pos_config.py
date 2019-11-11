# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    group_pos_user = fields.Many2one(
        'res.groups',
        string='Pos Active Group',
    )
