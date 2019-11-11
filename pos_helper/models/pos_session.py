# -*- coding: utf-8 -*-

from odoo import models, api


class PosSession(models.Model):
    _inherit = 'pos.session'

    @api.multi
    def action_pos_reopen_session(self):
        for session in self:
            session.state = 'opened'
