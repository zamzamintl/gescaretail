# -*- coding: utf-8 -*-
# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Sale User',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'POS Sale User',
    'description': """

POS Sale User
    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_sale_user_view.xml',
        'views/templates.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
