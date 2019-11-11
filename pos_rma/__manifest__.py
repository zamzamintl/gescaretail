# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Order Return',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Add return order feature in pos',
    'description': """

Add return order feature in pos

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_rma.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
