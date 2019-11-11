# See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class PosGiftCardController(http.Controller):

    @http.route('/web/search_gift_card', type="json", auth="user")
    def get_pos_gift_cards(self, **kw):
        search_string = kw.get('query')
        today = kw.get('today')
        res_partner_dict = request.env['res.partner'].search([
            ('name', 'ilike', search_string), ('customer', '=', True)]
        ).ids
        pos_gift_card_dict = request.env['pos.gift.card'].search([
            ('expire_date', '>=', today), '|',
            ('customer_id', 'in', res_partner_dict),
            ('card_no', 'ilike', search_string)]
        ).ids
        return pos_gift_card_dict
