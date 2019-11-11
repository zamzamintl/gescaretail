# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Reservation',
    'version': '12.0.0.1.3',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to reservation functionality',
    'description': """

This module allows you to reservation functionality
    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'data/pos_reservation.xml',
        'views/pos_reservation_views.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_reservation.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
