# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from openerp.exceptions import ValidationError


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    is_ccv_interim_journal = fields.Boolean(string='CCV interim journal')
    is_ccv_journal = fields.Boolean(string='CCV terminal journal')
    ccv_terminal_code = fields.Char(
        string='Terminal Reponse Code'
    )

    @api.constrains('is_ccv_interim_journal', 'is_ccv_journal')
    def _change_student_status(self):
        for record in self:
            if record.is_ccv_interim_journal and record.is_ccv_journal:
                raise ValidationError("A journal can't be both an interim "
                                      "journal and a ccv journal")
