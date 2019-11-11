# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class AccountJournalGroup(models.Model):
    _inherit = 'account.journal.group'

    confirmation_message = fields.Text(
        string='Confirmation Message'
    )
