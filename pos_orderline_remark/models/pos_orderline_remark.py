# See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    orderline_remark = fields.Boolean(
        'Orderline Remark', default=True,
        help='Allow remark on orderline')


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    remark = fields.Text("Product Remark")
