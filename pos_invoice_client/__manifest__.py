# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Invoice Client',
    'version': '12.0.0.0.1',
    'category': 'Point of Sale',
    'summary': '',
    'description': """
Enable invoice address management in pos
""",
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/assets.xml',
    ],
    'qweb': ['static/xml/client_detail.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
