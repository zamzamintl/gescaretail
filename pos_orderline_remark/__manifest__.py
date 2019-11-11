# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Orderline Remark',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allows to add remark on orderline',
    'description': """

This module allows you to add remark on orderline.

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_orderline_remark_views.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_orderline_remark.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
