# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api
from pytz import timezone
from datetime import datetime, timedelta


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_pos_reorder = fields.Boolean("Enable Order History", default=True)


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def get_order_history_data(self, domain):
        st_domain = domain.get('st_domain')
        line_domain = domain.get('line_domain')
        shop_id = domain.get('shop_id')
        order_id = domain.get('order_id')
        shop_vals = False
        if shop_id:
            shop_vals = self.env['res.partner'].search_read(
                [['id', '=', shop_id]])
        st_vals = self.env['account.bank.statement.line'].search_read(
            st_domain)
        line_vals = self.env['pos.order.line'].search_read(line_domain)
        statement_ids = []
        if domain.get('is_pos_reservation_install') and order_id:
            order = self.browse(order_id)
            if order and order.state == 'draft' and \
                    order.reservation_order_pay_history_ids:
                for reservation in order.reservation_order_pay_history_ids:
                    for reservation_statement in reservation.statement_ids:
                        pymnt = {}
                        pymnt['amount'] = reservation_statement.amount
                        pymnt['journal'] = \
                            reservation_statement.journal_id.name
                        pymnt['journal_id'] = \
                            reservation_statement.journal_id.id
                        pymnt['print_journal_name'] = \
                            reservation_statement.print_journal_name
                        statement_ids.append(pymnt)
        return [st_vals, line_vals, shop_vals, statement_ids]

    @api.model
    def ac_pos_search_read(self, domain):
        search_vals = self.search_read(domain)
        user_id = self.env['res.users'].browse(self._uid)
        tz = False
        if self._context and self._context.get('tz'):
            tz = timezone(self._context.get('tz'))
        elif user_id and user_id.tz:
            tz = timezone(user_id.tz)
        if tz:
            c_time = datetime.now(tz)
            hour_tz = int(str(c_time)[-5:][:2])
            min_tz = int(str(c_time)[-5:][3:])
            sign = str(c_time)[-6][:1]
            result = []
            for val in search_vals:
                if sign == '-':
                    val.update(
                        {
                            'date_order': (
                                val.get('date_order') -
                                timedelta(
                                    hours=hour_tz,
                                    minutes=min_tz)
                            ).strftime('%Y-%m-%d %H:%M:%S')})
                elif sign == '+':
                    val.update(
                        {
                            'date_order': (
                                val.get('date_order') +
                                timedelta(
                                    hours=hour_tz,
                                    minutes=min_tz)
                            ).strftime('%Y-%m-%d %H:%M:%S')})
                result.append(val)
            return result
        else:
            return search_vals
