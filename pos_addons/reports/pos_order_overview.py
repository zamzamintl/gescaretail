# See LICENSE file for full copyright and licensing details.

from odoo import api, models


class report_princess_pos_pos_overview(models.AbstractModel):
    _name = 'report.pos_addons.report_pos_overview'

    @api.model
    def _get_report_values(self, docids, data=None):
        data = dict(data or {})
        pos_ids = self.env['print.pos.overview'].browse(data.get('id'))
        return {
            'doc_ids': docids,
            'doc_model': 'print.pos.overview',
            'docs': pos_ids,
            'data': data,
        }
