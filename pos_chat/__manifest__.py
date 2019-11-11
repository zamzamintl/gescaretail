# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Chat',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow live chat in pos',
    'description': """

    Allow live chat in pos

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': [
        'point_of_sale', 'mail',
    ],
    'data': [
        'views/pos_config.xml',
        'views/template.xml',
    ],
    'qweb': ['static/src/xml/*.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
