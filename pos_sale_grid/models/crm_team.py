# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class CrmTeam(models.Model):
    _inherit = 'crm.team'

    sequence = fields.Integer()
