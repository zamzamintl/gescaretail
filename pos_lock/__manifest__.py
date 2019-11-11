# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Lock',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to lock Pos Screen',
    'description': """

Allow to lock Pos Screen

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_lock_view.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_lock.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
