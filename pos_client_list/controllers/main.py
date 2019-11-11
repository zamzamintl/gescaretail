# See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class PosPartnerController(http.Controller):

    @http.route('/web/search_partners', type="json", auth="user")
    def get_pos_partners(self, **kw):
        search_string = kw.get('query')
        res_partner_dict = request.env['res.partner'].search([
            ('name', 'ilike', search_string), ('customer', '=', True)],
            order='name'
        ).ids
        return res_partner_dict
