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

export interface OngMembership extends Struct.ComponentSchema {
  collectionName: 'components_ong_memberships';
  info: {
    description: '';
    displayName: 'Ong Membership';
  };
  attributes: {
    ong: Schema.Attribute.Relation<'oneToOne', 'api::ong.ong'>;
    rolMembruOng: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'evaluation.dimension': EvaluationDimension;
      'evaluation.question': EvaluationQuestion;
      'ong.membership': OngMembership;
    }
  }
}
