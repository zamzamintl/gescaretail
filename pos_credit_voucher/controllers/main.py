# -*- coding: utf-8 -*-
# See LICENSE file for full copyright and licensing details.
from odoo import http
from odoo.http import request


class PosCreditVoucherController(http.Controller):

    @http.route('/web/search_credit_voucher', type="json", auth="user")
    def get_pos_credit_vouchers(self, **kw):
        search_string = kw.get('query')
        today = kw.get('today')
        res_partner_dict = request.env['res.partner'].search([
            ('name', 'ilike', search_string), ('customer', '=', True)]
        ).ids
        pos_credit_voucher_dict = request.env['pos.credit.voucher'].search([
            ('expire_date', '>=', today), '|',
            ('customer_id', 'in', res_partner_dict),
            ('credit_voucher_no', 'ilike', search_string)]
        ).ids
        return pos_credit_voucher_dict
