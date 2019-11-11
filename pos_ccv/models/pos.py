# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class PosConfig(models.Model):
    _inherit = 'pos.config'

    has_ccv_endpoint = fields.Boolean(string='CCV endpoint present')
    ccv_endpoint_address = fields.Char(string='CCV Endpoint address(IP/URL)')
