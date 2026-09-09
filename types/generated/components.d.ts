import type { Schema, Struct } from '@strapi/strapi';

export interface EvaluationDimension extends Struct.ComponentSchema {
  collectionName: 'components_evaluation_dimensions';
  info: {
    description: '';
    displayName: 'Dimension';
  };
  attributes: {
    comment: Schema.Attribute.Text;
    dimensionKey: Schema.Attribute.String & Schema.Attribute.Required;
    quiz: Schema.Attribute.Component<'evaluation.question', true>;
    submitted: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
  };
}

export interface EvaluationQuestion extends Struct.ComponentSchema {
  collectionName: 'components_evaluation_questions';
  info: {
    description: '';
    displayName: 'Question';
  };
  attributes: {
    answer: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 5;
          min: 1;
        },
        number
      >;
    questionId: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface FooterSocial extends Struct.ComponentSchema {
  collectionName: 'components_footer_socials';
  info: {
    description: 'One social profile. Built-in platforms render their own icon; `other` names itself through `label`.';
    displayName: 'Social Link';
  };
  attributes: {
    label: Schema.Attribute.String;
    platform: Schema.Attribute.Enumeration<
      [
        'facebook',
        'twitter',
        'instagram',
        'linkedin',
        'youtube',
        'tiktok',
        'github',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MenuItem extends Struct.ComponentSchema {
  collectionName: 'components_menu_items';
  info: {
    description: 'Top-level menu entry. `url` is optional because a footer parent is a column heading that never redirects.';
    displayName: 'Menu Item';
  };
  attributes: {
    children: Schema.Attribute.Component<'menu.sub-item', true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    pagina: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    url: Schema.Attribute.String;
  };
}

export interface MenuSubItem extends Struct.ComponentSchema {
  collectionName: 'components_menu_sub_items';
  info: {
    description: 'Second-level menu link. Declares no children, so the tree cannot go deeper than two levels.';
    displayName: 'Menu Sub Item';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    pagina: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    url: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'evaluation.dimension': EvaluationDimension;
      'evaluation.question': EvaluationQuestion;
      'footer.social': FooterSocial;
      'menu.item': MenuItem;
      'menu.sub-item': MenuSubItem;
    }
  }
}
