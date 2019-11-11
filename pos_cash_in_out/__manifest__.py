# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Cash In/Out',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow cash in/out functionality',
    'description': """

Allow cash in/out functionality

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'data': [
        'view/pos_cash_in_out_view.xml',
        'view/templates.xml'
    ],
    'depends': ['point_of_sale'],
    'qweb': ['static/src/xml/pos_cash_in_out.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
